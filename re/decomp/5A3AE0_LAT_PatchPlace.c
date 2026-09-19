// 0x5a3ae0 LAT_PatchPlace size=79F

unsigned int __thiscall sub_5A3AE0(int *this)
{
  int *v1; // esi
  int i; // eax
  int v3; // edi
  double *v4; // ebp
  int v5; // esi
  int j; // eax
  int v7; // ebp
  unsigned int v8; // edi
  unsigned int v9; // esi
  int v10; // eax
  _DWORD *v11; // eax
  int v12; // eax
  int v13; // eax
  int v14; // eax
  bool v15; // cc
  unsigned int v16; // esi
  unsigned int v17; // eax
  signed int v18; // ebp
  unsigned int result; // eax
  unsigned int v20; // edi
  unsigned int v21; // esi
  int v22; // eax
  int v23; // eax
  int v24; // esi
  unsigned int v25; // eax
  unsigned int v26; // eax
  unsigned int v27; // eax
  int v28; // [esp-Ch] [ebp-74h]
  int v29; // [esp-Ch] [ebp-74h]
  int v30; // [esp-Ch] [ebp-74h]
  int v31; // [esp-Ch] [ebp-74h]
  double v32; // [esp-8h] [ebp-70h]
  int v33; // [esp+14h] [ebp-54h]
  int v34; // [esp+14h] [ebp-54h]
  int v35; // [esp+14h] [ebp-54h]
  signed int v37; // [esp+18h] [ebp-50h]
  int v38; // [esp+1Ch] [ebp-4Ch] BYREF
  double v39; // [esp+20h] [ebp-48h]
  int v40; // [esp+2Ch] [ebp-3Ch] BYREF
  double v41; // [esp+30h] [ebp-38h]
  double v42; // [esp+38h] [ebp-30h]
  double v43; // [esp+40h] [ebp-28h]
  long double v44; // [esp+48h] [ebp-20h]
  __int64 v45; // [esp+50h] [ebp-18h]
  __int64 v46; // [esp+58h] [ebp-10h]
  __int64 v47; // [esp+60h] [ebp-8h]

  v1 = this;
  sub_578350(&stru_87F7E8);
  for ( i = sub_578290(&stru_87F7E8); i != 0; i = sub_578290(&stru_87F7E8) )
  {
    LODWORD(v39) = *(_DWORD *)(i + 36);
    *((_DWORD *)dword_ABED10 + 20 * SLOWORD(v39) + 20 * dword_89C2DC * SWORD1(v39) + 15) = 0;
  }
  sub_578350(&stru_87F7E8);
  v3 = sub_578290(&stru_87F7E8);
  do
  {
    *(_QWORD *)&v44 = (unsigned int)sub_65C780(&unk_ABE890);
    v38 = sub_7C5F00((double)*(__int64 *)&v44 * 0.000000004889443517869674 + 20.0);
  }
  while ( (unsigned int)v38 > 0x28 );
  do
  {
    *(_QWORD *)&v44 = (unsigned int)sub_65C780(&unk_ABE890);
    v33 = sub_7C5F00((double)*(__int64 *)&v44 * 0.000000004889443517869674 + 20.0);
  }
  while ( (unsigned int)v33 > 0x28 );
  do
  {
    *(_QWORD *)&v44 = (unsigned int)sub_65C780(&unk_ABE890);
    v40 = sub_7C5F00((double)*(__int64 *)&v44 * 0.000000004889443517869674 + 20.0);
  }
  while ( (unsigned int)v40 > 0x28 );
  if ( v3 != 0 )
  {
    do
    {
      LODWORD(v39) = *(_DWORD *)(v3 + 36);
      v4 = (double *)((char *)dword_ABED10 + 80 * SLOWORD(v39) + 80 * dword_89C2DC * SWORD1(v39));
      if ( sub_486380((_DWORD *)v3)
        && *(_BYTE *)(v3 + 284) == 0
        && *(_DWORD *)(v3 + 68) == -1
        && *(_DWORD *)(v3 + 228) == 0
        && *((_BYTE *)v4 + 69) == 0 )
      {
        LODWORD(v39) = *(_DWORD *)(v3 + 36);
        v5 = SLOWORD(v39) + (SWORD1(v39) << 9);
        v45 = (unsigned int)sub_65C780(&unk_ABE890);
        if ( (double)v45 * 2.328306437080797e-10 >= v4[3] )
        {
          v46 = (unsigned int)sub_65C780(&unk_ABE890);
          if ( (double)v46 * 2.328306437080797e-10 >= v4[5] )
          {
            v47 = (unsigned int)sub_65C780(&unk_ABE890);
            if ( (double)v47 * 2.328306437080797e-10 < v4[4] )
            {
              v44 = 20.0;
              v42 = (double)v40;
              if ( v42 - 20.0 > 80.0 || v42 + 20.0 < 4.0 )
              {
                v44 = 38.0;
                v42 = 42.0;
              }
              do
              {
                do
                  v39 = sub_5980C0((double *)&byte_ABDFB8) * v44 + v42;
                while ( v39 < 4.0 );
              }
              while ( v39 > 80.0 );
              v30 = sub_7C5F00(v39);
              sub_5A4B60(v3, dword_AA0E18, v30, v5, 0);
            }
          }
          else
          {
            v43 = 20.0;
            v42 = (double)v33;
            if ( v42 - 20.0 > 80.0 || v42 + 20.0 < 4.0 )
            {
              v43 = 38.0;
              v42 = 42.0;
            }
            do
            {
              do
                v39 = sub_5980C0((double *)&byte_ABDFB8) * v43 + v42;
              while ( v39 < 4.0 );
            }
            while ( v39 > 80.0 );
            v29 = sub_7C5F00(v39);
            sub_5A4B60(v3, dword_ABB104, v29, v5, 0);
          }
        }
        else
        {
          v41 = 20.0;
          v42 = (double)v38;
          if ( v42 - 20.0 > 80.0 || v42 + 20.0 < 4.0 )
          {
            v41 = 38.0;
            v42 = 42.0;
          }
          do
          {
            do
              v39 = sub_5980C0((double *)&byte_ABDFB8) * v41 + v42;
            while ( v39 < 4.0 );
          }
          while ( v39 > 80.0 );
          v28 = sub_7C5F00(v39);
          sub_5A4B60(v3, dword_ABC2B8, v28, v5, 0);
        }
      }
      v3 = sub_578290(&stru_87F7E8);
    }
    while ( v3 != 0 );
    v1 = this;
  }
  sub_578350(&stru_87F7E8);
  for ( j = sub_578290(&stru_87F7E8); j != 0; j = sub_578290(&stru_87F7E8) )
    sub_47CA80(j);
  LODWORD(v39) = sub_7C5F00(((double)v1[25] * 0.1 + 0.7) * ((double)v1[23] * 0.01) * (double)v1[191]);
  v34 = 0;
  if ( SLODWORD(v39) > 0 )
  {
    do
    {
      if ( v34 >= 100 )
        break;
      v7 = 0;
      do
      {
        v8 = dword_89C2DC * dword_89C2DC - 1;
        do
        {
          v9 = sub_598030(0, v8);
          v10 = sub_42D470(0, 0);
        }
        while ( (unsigned __int8)sub_50E470(v10) != 0 );
        ++v7;
        v38 = *((_DWORD *)dword_ABED10 + 20 * v9);
        if ( v7 > 200 )
        {
          v12 = *(_DWORD *)sub_42D470(0, 0);
          goto LABEL_48;
        }
        v11 = (_DWORD *)sub_5657A0(&v38);
      }
      while ( !sub_486380(v11) );
      v12 = v38;
LABEL_48:
      v40 = v12;
      do
      {
        do
          v44 = sub_5980C0((double *)&byte_ABDFB8) * 0.1 + 0.2;
        while ( v44 < 0.05 );
      }
      while ( v44 > 0.4 );
      do
      {
        do
          v43 = sub_5980C0((double *)&byte_ABDFB8) * 10.0 + 25.0;
        while ( v43 < 10.0 );
      }
      while ( v43 > 35.0 );
      v32 = v44;
      v31 = sub_7C5F00(v43);
      v13 = sub_5657A0(&v40);
      v14 = sub_5A45E0(v13, v31, v32);
      v15 = LODWORD(v39) - v14 <= 0;
      LODWORD(v39) -= v14;
      ++v34;
    }
    while ( !v15 );
  }
  v16 = sub_42B1F0() / 200;
  v47 = v16 + 1;
  *(double *)&v46 = (double)v47;
  do
  {
    v47 = (unsigned int)sub_65C780(&unk_ABE890);
    v17 = sub_7C5F00((double)v47 * *(double *)&v46 * 2.328306437080797e-10);
    v18 = v17;
  }
  while ( v17 > v16 );
  result = 5 * v17;
  v37 = 0;
  v35 = 0;
  if ( 5 * v18 > 0 )
  {
    while ( 1 )
    {
      if ( v37 >= v18 )
        return result;
      v20 = dword_89C2DC * dword_89C2DC - 1;
      do
      {
        v47 = v20 + 1;
        v43 = (double)v47;
        do
        {
          v46 = (unsigned int)sub_65C780(&unk_ABE890);
          v21 = sub_7C5F00((double)v46 * v43 * 2.328306437080797e-10);
        }
        while ( v21 > v20 );
        v22 = sub_42D470(0, 0);
      }
      while ( (unsigned __int8)sub_50E470(v22) != 0 );
      v40 = *((_DWORD *)dword_ABED10 + 20 * v21);
      v23 = sub_5657A0(&v40);
      v24 = v23;
      if ( *(_DWORD *)(v23 + 68) == -1 )
        break;
LABEL_72:
      result = ++v35;
      if ( v35 >= 5 * v18 )
        return result;
    }
    if ( (unsigned __int8)sub_486790(v23) != 0 )
    {
      do
      {
        v45 = (unsigned int)sub_65C780(&unk_ABE890);
        v25 = sub_7C5F00((double)v45 * 0.000000001164153218540399);
      }
      while ( v25 > 4 );
      v26 = v25 + 168;
    }
    else
    {
      if ( !sub_486380((_DWORD *)v24) && !sub_4867B0((int *)v24) )
        goto LABEL_71;
      do
      {
        *(_QWORD *)&v44 = (unsigned int)sub_65C780(&unk_ABE890);
        v27 = sub_7C5F00((double)*(__int64 *)&v44 * 0.000000001164153218540399);
      }
      while ( v27 > 4 );
      v26 = v27 + 173;
    }
    *(_DWORD *)(v24 + 68) = v26;
LABEL_71:
    *(_BYTE *)(v24 + 286) = 0;
    sub_47D2B0(v24, -1);
    ++v37;
    goto LABEL_72;
  }
  return result;
}
