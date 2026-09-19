// 0x595400 Tech_MapType2 size=274

char __thiscall sub_595400(_DWORD *this)
{
  _DWORD *v1; // ebx
  int v2; // eax
  int v3; // ebp
  unsigned int v4; // esi
  unsigned int v5; // eax
  unsigned int v6; // esi
  unsigned int v7; // eax
  int v8; // ebp
  _WORD *v9; // edi
  char v10; // bl
  __int16 v11; // dx
  int v12; // esi
  int v13; // eax
  char result; // al
  char v15; // [esp+13h] [ebp-39h]
  int v16; // [esp+14h] [ebp-38h] BYREF
  int *v17; // [esp+18h] [ebp-34h]
  int v18; // [esp+1Ch] [ebp-30h]
  int v19; // [esp+20h] [ebp-2Ch]
  _DWORD *v20; // [esp+24h] [ebp-28h]
  __int64 v21; // [esp+28h] [ebp-24h] BYREF
  __int64 v22; // [esp+30h] [ebp-1Ch]
  __int64 v23; // [esp+38h] [ebp-14h]
  _DWORD v24[3]; // [esp+40h] [ebp-Ch] BYREF

  v1 = this;
  v20 = this;
  v2 = sub_5117D0(aNeutral);
  v3 = sub_502D30(v2);
  v15 = 0;
  v18 = 0;
  if ( operator new(0x720u) != nullptr )
  {
    v4 = *((_DWORD *)dword_8871E0 + 699) - 1;
    *(double *)&v23 = (double)*((unsigned int *)dword_8871E0 + 699);
    do
    {
      v21 = (unsigned int)sub_65C780(&unk_ABE890);
      v5 = sub_7C5F00((double)v21 * *(double *)&v23 * 2.328306437080797e-10);
    }
    while ( v5 > v4 );
    v17 = (int *)sub_43B740(*(_DWORD *)(*((_DWORD *)dword_8871E0 + 696) + 4 * v5), v3);
  }
  else
  {
    v17 = nullptr;
  }
  while ( v18 < 100 )
  {
    v6 = v1[14] - 1;
    v22 = (unsigned int)v1[14];
    *(double *)&v21 = (double)v22;
    do
    {
      v23 = (unsigned int)sub_65C780(&unk_ABE890);
      v7 = sub_7C5F00((double)v23 * *(double *)&v21 * 2.328306437080797e-10);
    }
    while ( v7 > v6 );
    v16 = *(_DWORD *)(v1[11] + 4 * v7);
    v8 = *(char *)(sub_5657A0(&v16) + 283);
    v9 = (_WORD *)(*(int (__thiscall **)(int, int))(*(_DWORD *)v17[328] + 144))(v17[328], 1);
    v10 = 1;
    while ( *v9 != 0x7FFF || v9[1] != 0x7FFF )
    {
      v11 = HIWORD(v16) + v9[1];
      LOWORD(v19) = v16 + *v9;
      HIWORD(v19) = v11;
      LODWORD(v21) = v19;
      v12 = sub_5657A0(&v21);
      if ( *(_DWORD *)(v12 + 228) != 0
        || !sub_486380((_DWORD *)v12)
        || *(char *)(v12 + 283) != v8
        || *(_DWORD *)(v12 + 236) == 3
        || (unsigned __int8)sub_578540(v12, 1) == 0
        || *((_BYTE *)dword_ABED10 + 80 * *(__int16 *)(v12 + 36) + 80 * dword_89C2DC * *(__int16 *)(v12 + 38) + 69) != 0 )
      {
        v10 = 0;
      }
      v9 += 2;
      if ( v10 == 0 )
        goto LABEL_24;
    }
    v24[0] = ((__int16)v16 << 8) + 128;
    v24[2] = 0;
    v13 = *v17;
    v24[1] = (SHIWORD(v16) << 8) + 128;
    if ( (*(unsigned __int8 (__thiscall **)(int *, _DWORD *, _DWORD))(v13 + 216))(v17, v24, 0) != 0 )
      v15 = 1;
LABEL_24:
    result = v15;
    ++v18;
    if ( v15 != 0 )
      return result;
    v1 = v20;
  }
  result = 0;
  if ( v17 != nullptr )
    return (*(char (__thiscall **)(int *, int))(*v17 + 32))(v17, 1);
  return result;
}
