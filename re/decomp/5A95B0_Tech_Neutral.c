// 0x5a95b0 Tech_Neutral size=366

_DWORD *__thiscall sub_5A95B0(_DWORD *this)
{
  _DWORD *result; // eax
  int v2; // ecx
  _DWORD *v3; // edi
  int i; // esi
  int v5; // eax
  int v6; // ebp
  unsigned int v7; // esi
  unsigned int v8; // eax
  _DWORD **v9; // ebx
  unsigned int v10; // edi
  unsigned int v11; // esi
  int v12; // eax
  _DWORD *v13; // eax
  int v14; // eax
  int v15; // ebp
  _WORD *v16; // edi
  char v17; // bl
  __int16 v18; // dx
  int v19; // esi
  _DWORD *v20; // eax
  char v21; // [esp+13h] [ebp-4Dh]
  int v22; // [esp+14h] [ebp-4Ch] BYREF
  _DWORD *v23; // [esp+18h] [ebp-48h]
  int v24; // [esp+1Ch] [ebp-44h]
  int v25; // [esp+20h] [ebp-40h] BYREF
  int v26; // [esp+24h] [ebp-3Ch]
  _DWORD *j; // [esp+28h] [ebp-38h]
  int v28; // [esp+2Ch] [ebp-34h]
  double v29; // [esp+30h] [ebp-30h] BYREF
  __int64 v30; // [esp+3Ch] [ebp-24h]
  __int64 v31; // [esp+44h] [ebp-1Ch]
  __int64 v32; // [esp+4Ch] [ebp-14h]
  _DWORD v33[3]; // [esp+54h] [ebp-Ch] BYREF

  if ( *(this + 15) == 2 )
  {
    do
    {
      v30 = (unsigned int)sub_65C780(&unk_ABE890);
      result = (_DWORD *)sub_7C5F00((double)v30 * 6.984919311242392e-10);
    }
    while ( (unsigned int)result > 2 );
    if ( (int)result > 0 )
    {
      v2 = dword_ABDFA0;
      v3 = result;
      result = dword_ABDF94;
      do
      {
        for ( i = 0; i < v2; ++i )
        {
          if ( *(int *)(result[i] + 32) > 0 )
          {
            sub_595400((_DWORD *)result[i]);
            v2 = dword_ABDFA0;
            result = dword_ABDF94;
          }
        }
        v3 = (_DWORD *)((char *)v3 - 1);
      }
      while ( v3 != nullptr );
    }
  }
  else
  {
    v5 = sub_5117D0(aNeutral);
    v28 = sub_502D30(v5);
    do
    {
      v30 = (unsigned int)sub_65C780(&unk_ABE890);
      result = (_DWORD *)sub_7C5F00((double)v30 * 0.000000001164153218540399);
    }
    while ( (unsigned int)result > 4 );
    v6 = 0;
    if ( (int)result > 0 )
    {
      for ( j = result; j != nullptr; j = (_DWORD *)((char *)j - 1) )
      {
        v21 = 0;
        v24 = 0;
        if ( operator new(0x720u) != nullptr )
        {
          v7 = *((_DWORD *)dword_8871E0 + 699) - 1;
          v31 = *((unsigned int *)dword_8871E0 + 699);
          v29 = (double)v31;
          do
          {
            v32 = (unsigned int)sub_65C780(&unk_ABE890);
            v8 = sub_7C5F00((double)v32 * v29 * 2.328306437080797e-10);
          }
          while ( v8 > v7 );
          v9 = (_DWORD **)sub_43B740(*(_DWORD *)(*((_DWORD *)dword_8871E0 + 696) + 4 * v8), v28);
          v23 = v9;
        }
        else
        {
          v23 = nullptr;
          v9 = nullptr;
        }
        while ( v24 < 100 )
        {
          do
          {
            v10 = dword_89C2DC * dword_89C2DC - 1;
            do
            {
              v11 = sub_598030(0, v10);
              v12 = sub_42D470(0, 0);
            }
            while ( (unsigned __int8)sub_50E470(v12) != 0 );
            ++v6;
            v25 = *((_DWORD *)dword_ABED10 + 20 * v11);
            if ( v6 > 200 )
            {
              v14 = *(_DWORD *)sub_42D470(0, 0);
              goto LABEL_29;
            }
            v13 = (_DWORD *)sub_5657A0(&v25);
          }
          while ( !sub_486380(v13) );
          v14 = v25;
LABEL_29:
          v22 = v14;
          v15 = *(char *)(sub_5657A0(&v22) + 283);
          v16 = (_WORD *)(*(int (__thiscall **)(_DWORD *, int))(*v9[328] + 144))(v9[328], 1);
          v17 = 1;
          while ( *v16 != 0x7FFF || v16[1] != 0x7FFF )
          {
            v18 = HIWORD(v22) + v16[1];
            LOWORD(v26) = v22 + *v16;
            HIWORD(v26) = v18;
            LODWORD(v29) = v26;
            v19 = sub_5657A0(&v29);
            if ( *(_DWORD *)(v19 + 228) != 0
              || !sub_486380((_DWORD *)v19)
              || *(char *)(v19 + 283) != v15
              || *(_DWORD *)(v19 + 236) == 3
              || (unsigned __int8)sub_578540(v19, 1) == 0
              || *((_BYTE *)dword_ABED10 + 80 * *(__int16 *)(v19 + 36) + 80 * dword_89C2DC * *(__int16 *)(v19 + 38) + 69) != 0 )
            {
              v17 = 0;
            }
            v16 += 2;
            if ( v17 == 0 )
              goto LABEL_43;
          }
          v33[0] = ((__int16)v22 << 8) + 128;
          v33[2] = 0;
          v20 = (_DWORD *)*v23;
          v33[1] = (SHIWORD(v22) << 8) + 128;
          if ( ((unsigned __int8 (__thiscall *)(_DWORD *, _DWORD *, _DWORD))v20[54])(v23, v33, 0) != 0 )
            v21 = 1;
LABEL_43:
          ++v24;
          if ( v21 != 0 )
          {
            v6 = 0;
            goto LABEL_47;
          }
          v9 = (_DWORD **)v23;
          v6 = 0;
        }
        if ( v9 != nullptr )
          ((void (__thiscall *)(_DWORD **, int))(*v9)[8])(v9, 1);
LABEL_47:
        result = (_DWORD *)((char *)j - 1);
      }
    }
  }
  return result;
}
