// 0x5a35f0 Hills_Main size=2C1

int __thiscall sub_5A35F0(void *this)
{
  int v2; // esi
  double *v3; // esi
  int v4; // edi
  int v5; // ecx
  int v6; // eax
  int v7; // ebp
  int i; // ebx
  unsigned int v9; // eax
  bool v10; // zf
  int v11; // esi
  int v12; // edi
  int result; // eax
  char v14; // al
  char v15; // bl
  int v16; // ebp
  _WORD *v17; // esi
  int v18; // eax
  __int16 v19; // cx
  _WORD *v20; // esi
  int v21; // ebp
  __int16 v22; // dx
  int v23; // eax
  char v24; // dl
  char v25; // [esp+13h] [ebp-35h]
  int v26; // [esp+14h] [ebp-34h]
  int v27; // [esp+14h] [ebp-34h]
  int v28; // [esp+18h] [ebp-30h]
  int v29; // [esp+18h] [ebp-30h]
  int v30; // [esp+1Ch] [ebp-2Ch]
  int v31; // [esp+1Ch] [ebp-2Ch]
  double v32; // [esp+20h] [ebp-28h] BYREF
  _DWORD v33[4]; // [esp+28h] [ebp-20h] BYREF
  _DWORD v34[4]; // [esp+38h] [ebp-10h]

  sub_5A33F0();
  sub_5A2F50(this);
  sub_6B2A70();
  if ( dword_89C2DC * dword_89C2DC > 0 )
  {
    v2 = 0;
    v28 = dword_89C2DC * dword_89C2DC;
    v26 = 0;
    do
    {
      v3 = (double *)((char *)dword_ABED10 + v2);
      if ( *(_WORD *)v3 != 0 || *((_WORD *)v3 + 1) != 0 )
      {
        v4 = sub_5657A0(v3);
        v32 = (double)*(char *)(v4 + 283) + v3[1];
        v30 = sub_6B4100((int *)v4);
        v5 = sub_7C5F00(v32 - (double)v30);
        v6 = abs32(v5);
        v7 = v5 >= 0 ? 1 : -1;
        if ( v6 > 0 )
        {
          for ( i = v6; i != 0; --i )
          {
            v9 = sub_6B4240(v4, v7);
            sub_6B3E60(v7, 0, *(_DWORD *)v3, v9);
          }
        }
      }
      v2 = v26 + 80;
      v10 = v28 == 1;
      v26 += 80;
      --v28;
    }
    while ( !v10 );
  }
  sub_6B3850();
  sub_578350(&stru_87F7E8);
  v11 = 0;
  v12 = sub_578290(&stru_87F7E8);
  v33[0] = 0;
  result = 65537;
  v33[1] = 1;
  v33[2] = 65537;
  v33[3] = 0x10000;
  v34[0] = 11;
  v34[1] = 12;
  v34[2] = 9;
  v34[3] = 10;
  if ( v12 != 0 )
  {
    while ( 1 )
    {
      v14 = *(_BYTE *)(v12 + 284);
      v15 = 0;
      v25 = 1;
      if ( v14 == 5 )
        break;
      if ( v14 == 11 )
      {
        v15 = 1;
        do
        {
          v19 = HIWORD(v33[v11]);
          LODWORD(v32) = *(_DWORD *)(v12 + 36);
          LOWORD(v27) = LOWORD(v33[v11]) + LOWORD(v32);
          HIWORD(v27) = WORD1(v32) + v19;
          LODWORD(v32) = v27;
          if ( *(unsigned __int8 *)(sub_5657A0(&v32) + 284) != v34[v11] )
            v25 = 0;
          ++v11;
        }
        while ( v11 < 4 );
        goto LABEL_21;
      }
LABEL_24:
      result = sub_578290(&stru_87F7E8);
      v12 = result;
      v11 = 0;
      if ( result == 0 )
        return result;
    }
    v16 = 0;
    v17 = v33;
    do
    {
      v18 = *(_DWORD *)(v12 + 36);
      LOWORD(v29) = v18 + *v17;
      HIWORD(v29) = HIWORD(v18) + v17[1];
      LODWORD(v32) = v29;
      if ( *(unsigned __int8 *)(sub_5657A0(&v32) + 284) != v16 + 5 )
        v25 = 0;
      ++v16;
      v17 += 2;
    }
    while ( v16 < 4 );
LABEL_21:
    if ( v25 != 0 )
    {
      v20 = v33;
      v21 = 4;
      do
      {
        v22 = v20[1];
        LODWORD(v32) = *(_DWORD *)(v12 + 36);
        LOWORD(v31) = *v20 + LOWORD(v32);
        HIWORD(v31) = WORD1(v32) + v22;
        LODWORD(v32) = v31;
        v23 = sub_5657A0(&v32);
        v24 = *(_BYTE *)(v23 + 283);
        v20 += 2;
        --v21;
        *(_DWORD *)(v23 + 56) = 0xFFFF;
        *(_BYTE *)(v23 + 282) = 0;
        *(_BYTE *)(v23 + 284) = 0;
        *(_BYTE *)(v23 + 283) = v15 + v24;
      }
      while ( v21 != 0 );
    }
    goto LABEL_24;
  }
  return result;
}
